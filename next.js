#!/usr/bin/env node

const process = require('process');

const nextMeeting = ({ day = 0, hour = 9, minute = 0 }) => {
  const now = new Date();
  let next = new Date();

  next = new Date(next.getTime() + ((7 + day - next.getDay()) % 7) * 86400 * 1000);
  next.setSeconds(0);
  next.setMilliseconds(0);
  next.setHours(hour);
  next.setMinutes(minute);

  if (next.getTime() < now.getTime())
    next = new Date(next.getTime() + 7 * 86400 * 1000);

  const nextEnd = new Date(next.getTime() + 3600 * 1000);

  return { next, nextEnd };
};

exports.nextMeeting = nextMeeting;

if (require.main === module) {
  const { argv } = process;
  console.log('next:', nextMeeting({
    day: parseInt(argv[2]),
    hour: parseInt(argv[3]),
    minute: parseInt(argv[4]),
  }));
}
