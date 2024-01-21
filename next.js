#!/usr/bin/env node

const desiredDay = 0; // Sunday
const desiredHour = 11; // 11:10 AM
const desiredMinutes = 10;

const now = new Date();
let next = new Date();

next = new Date(next.getTime() + ((7 - next.getDay()) % 7) * 86400 * 1000);
next.setSeconds(0);
next.setMilliseconds(0);
next.setHours(desiredHour);
next.setMinutes(desiredMinutes);

if (next.getTime() < now.getTime())
  next = new Date(next.getTime() + 7 * 86400 * 1000);

const nextEnd = new Date(next.getTime() + 3600 * 1000);

exports.next = next;
exports.nextEnd = nextEnd;
