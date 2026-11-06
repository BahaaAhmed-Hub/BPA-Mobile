# scripts

Node harnesses for the pure logic under `src/lib`. They are not app code and are excluded from `tsc`.

Run one with a resolver that adds `.ts` to extensionless imports:

```
node --import ./scripts/ts-resolve.mjs scripts/time-logic.test.ts
```

`time-logic.test.ts` and `time-timer.test.ts` hold the web's documented time rules (touching is not overlapping, three
tasks run together is 2 h worked and 6 task-hours, Cairo's changeover days are 23 and 25 hours, a timer left running is
cut at a day and flagged). They run under `TZ=UTC` to prove none of it depends on the machine's zone.
