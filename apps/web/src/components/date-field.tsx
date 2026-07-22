import { Button } from "@dcsp-letter-management/ui/components/button";
import { Calendar } from "@dcsp-letter-management/ui/components/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@dcsp-letter-management/ui/components/popover";
import { cn } from "@dcsp-letter-management/ui/lib/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

export function DatePicker({ value, onChange, onBlur }: DatePickerProps) {
  const selected = value ? new Date(`${value}T00:00:00`) : undefined;

  return (
    <Popover onOpenChange={(open) => !open && onBlur?.()}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={cn("w-full justify-start font-normal", !selected && "text-muted-foreground")}
          />
        }
      >
        <CalendarIcon />
        {selected ? format(selected, "d MMM yyyy") : "Pick a date"}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => date && onChange(format(date, "yyyy-MM-dd"))}
          disabled={{ after: new Date() }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
