import { Effect } from "effect";
import * as NumberSequenceRepo from "../repositories/NumberSequenceRepo.ts";

export const MAX_NUMBER = 99999;

export const format = (division: string, seq: number): string =>
  `DCSP/${division}/${String(seq).padStart(5, "0")}`;

export const issueNext = (division: string) =>
  Effect.gen(function* () {
    const currentYear = new Date().getFullYear();
    const row = yield* NumberSequenceRepo.getForUpdate(division, currentYear);

    let nextNumber = row.current_number + 1;
    if (nextNumber > MAX_NUMBER) {
      nextNumber = 0;
    }

    yield* NumberSequenceRepo.update(division, nextNumber, currentYear);
    return format(division, nextNumber);
  });

export const issueBatch = (division: string, count: number) =>
  Effect.gen(function* () {
    const numbers: Array<string> = [];
    for (let i = 0; i < count; i += 1) {
      numbers.push(yield* issueNext(division));
    }
    return numbers;
  });
