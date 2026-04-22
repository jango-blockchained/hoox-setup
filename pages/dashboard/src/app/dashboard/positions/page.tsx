import { PositionsTable } from "@/components/dashboard/positions-table"

export default function PositionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Positions</h1>
        <p className="text-sm text-muted-foreground">
          Manage your active trading positions
        </p>
      </div>
      <PositionsTable />
    </div>
  )
}
