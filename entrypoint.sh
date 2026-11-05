#!/bin/sh

echo "run_id: $RUN_ID"
echo "profile: ${PROFILE:-default}"

ZAP_URL_LOCAL=http://127.0.0.1:8080
ZAP_LOG=/tmp/zap.log

# Starts the ZAP bundled in the image (Dockerfile) for the security scan. Its API has no key, so it only listens on
# loopback. On CDP every outbound request goes through the platform proxy (HTTP_PROXY), so ZAP passes the tests'
# traffic on to it. curl skips the proxy: ZAP is in this container.
start_zap() {
  set -- -daemon -silent -host 127.0.0.1 -port 8080 -config api.disablekey=true
  if [ -n "$HTTP_PROXY" ]; then
    upstream=${HTTP_PROXY#*://}
    upstream=${upstream%%/*}
    set -- "$@" \
      -config network.connection.httpProxy.enabled=true \
      -config "network.connection.httpProxy.host=${upstream%:*}" \
      -config "network.connection.httpProxy.port=${upstream##*:}"
  fi

  /opt/zap/zap.sh "$@" > "$ZAP_LOG" 2>&1 &
  ZAP_PID=$!

  i=0
  while [ $i -lt 60 ]; do
    if curl -sf --noproxy '*' "$ZAP_URL_LOCAL/JSON/core/view/version/" > /dev/null; then
      echo "ZAP started"
      return 0
    fi
    sleep 2
    i=$((i + 1))
  done
  echo "ZAP didn't start within 120s:"
  tail -n 50 "$ZAP_LOG"
  return 1
}

stop_zap() {
  curl -sf --noproxy '*' "$ZAP_URL_LOCAL/JSON/core/action/shutdown/" > /dev/null
  wait "$ZAP_PID" 2> /dev/null
}

# PROFILE is set from the Portal's Run form. compatibility runs the @compat tests on BrowserStack's browsers; the
# SDK has to wrap the playwright command itself, so it has its own script. accessibility runs only the @accessibility
# tests (the default run includes them too). The default run goes through ZAP, which fails it on any High or Medium
# security alert (test/security). That's also the run the Portal starts after each deployment of the frontend.
if [ "$PROFILE" = "compatibility" ]; then
  npm run test:compatibility
  test_exit_code=$?
elif [ "$PROFILE" = "accessibility" ]; then
  npm run test:accessibility
  test_exit_code=$?
elif start_zap; then
  ZAP_URL=$ZAP_URL_LOCAL npm test
  test_exit_code=$?
  stop_zap
else
  # Still run the journey tests for their evidence, but fail: the security scan didn't happen.
  echo "the security scan couldn't run: ZAP didn't start"
  npm test
  test_exit_code=1
fi

npm run report:publish
publish_exit_code=$?

if [ $publish_exit_code -ne 0 ]; then
  echo "failed to publish test results"
  exit $publish_exit_code
fi

# The Portal reads pass or fail from this exit code.
if [ $test_exit_code -ne 0 ]; then
  echo "test suite failed"
  exit 1
fi

echo "test suite passed"
exit 0
