import { DIVISION_NAMES, type DivisionCode } from "@dcsp-letter-management/domain/division";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@dcsp-letter-management/ui/components/combobox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@dcsp-letter-management/ui/components/field";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { orpc } from "@/utils/orpc";

type OfficerOption = { value: string; name: string; subtitle: string; label: string; division: DivisionCode };

export function RelevantOfficersField({
  division,
  value,
  onChange,
  errors,
}: {
  /**
   * Restricts the roster to one division. Omit to show every active officer
   * (DCS's review dialog, which has no division yet) — once one officer is
   * picked, officers from other divisions drop out of the search results,
   * since every officer on a letter must share a division.
   */
  division?: DivisionCode;
  value: string[];
  onChange: (value: string[]) => void;
  errors?: Array<{ message?: string } | undefined>;
}) {
  const officers = useQuery(orpc.officers.listActive.queryOptions({ input: division ? { division } : {} }));
  const anchor = useComboboxAnchor();

  const selectedOfficers = officers.data?.filter((one) => value.includes(one.id)) ?? [];
  const lockedDivision = division ?? selectedOfficers[0]?.division;
  const noOfficers = officers.isSuccess && officers.data.length === 0;

  const options: OfficerOption[] = (officers.data ?? [])
    .filter((one) => lockedDivision === undefined || one.division === lockedDivision)
    .map((one) => ({
      value: one.id,
      name: one.name,
      subtitle: division ? one.position : `${one.position} · ${DIVISION_NAMES[one.division]}`,
      label: `${one.name} — ${one.position} (${DIVISION_NAMES[one.division]})`,
      division: one.division,
    }));
  const selectedOptions = options.filter((option) => value.includes(option.value));

  return (
    <Field data-invalid={errors && errors.length > 0 ? true : undefined}>
      <FieldLabel>Relevant Officer(s)</FieldLabel>
      {officers.isPending ? (
        <FieldDescription>Loading officers…</FieldDescription>
      ) : noOfficers ? (
        <FieldDescription>
          No active officers yet — add one from the{" "}
          <Link to="/officers" className="underline underline-offset-4">
            Officers roster
          </Link>
          .
        </FieldDescription>
      ) : (
        <Combobox items={options} multiple value={selectedOptions} onValueChange={(next) => onChange(next.map((option) => option.value))}>
          <ComboboxChips ref={anchor}>
            {selectedOptions.map((option) => (
              <ComboboxChip key={option.value} aria-label={option.label} title={option.label} className="max-w-40">
                <span className="min-w-0 truncate">{option.name}</span>
              </ComboboxChip>
            ))}
            <ComboboxChipsInput placeholder={selectedOptions.length === 0 ? "Search officers by name…" : undefined} />
          </ComboboxChips>
          <ComboboxContent anchor={anchor}>
            <ComboboxEmpty>No matching officers.</ComboboxEmpty>
            <ComboboxList>
              {(option: OfficerOption) => (
                <ComboboxItem value={option}>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{option.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{option.subtitle}</span>
                  </span>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      )}
      <FieldError errors={errors} />
    </Field>
  );
}
