import { DIVISION_NAMES } from "@dcsp-letter-management/domain/division";
import { Button } from "@dcsp-letter-management/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@dcsp-letter-management/ui/components/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dcsp-letter-management/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import Loader from "@/components/loader";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/print-numbers/")({
  component: PrintNumbersPage,
});

const ROWS_PER_PAGE = 16;

function PrintNumbersPage() {
  const query = useQuery(orpc.letters.printNumbersToday.queryOptions());
  const items = query.data ?? [];
  const pages = chunk(items, ROWS_PER_PAGE);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <h1 className="text-lg font-semibold">Print Numbers — Today</h1>
          <Button onClick={() => window.print()} disabled={items.length === 0}>
            Print
          </Button>
        </div>

        {query.isPending ? (
          <Loader />
        ) : items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No numbers issued today</EmptyTitle>
              <EmptyDescription>Letter numbers created today will appear here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          pages.map((pageItems, pageIndex) => (
            <Table key={pageIndex} className="break-after-page">
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Reference Number</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead>Relevant Officer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((letter, index) => (
                  <TableRow key={letter.id}>
                    <TableCell>{pageIndex * ROWS_PER_PAGE + index + 1}</TableCell>
                    <TableCell>{letter.referenceNumber}</TableCell>
                    <TableCell>{DIVISION_NAMES[letter.division]}</TableCell>
                    <TableCell>{letter.relevantOfficer?.name ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ))
        )}
      </div>
    </AppShell>
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}
