#!/bin/sh

echo "run_id: $RUN_ID"
npm test
test_exit_code=$?

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
