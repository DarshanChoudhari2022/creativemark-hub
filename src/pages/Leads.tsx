import { useState } from "react";
import { Plus, User, Calendar as CalIcon, GripVertical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared";
import { leads as initialLeads, Lead, LeadStage } from "@/data/leads";
import { formatINR } from "@/lib/format";
import { toast } from "sonner";

const STAGES: LeadStage[] = ["New", "Contacted", "Quotation Sent", "Negotiation", "Converted", "Lost"];
const STAGE_COLORS: Record<LeadStage, string> = {
  "New": "border-t-foreground",
  "Contacted": "border-t-warning",
  "Quotation Sent": "border-t-blue-500",
  "Negotiation": "border-t-orange-500",
  "Converted": "border-t-success",
  "Lost": "border-t-primary",
};

const Leads = () => {
  const [leads, setLeads] = useState(initialLeads);
  const [active, setActive] = useState<Lead | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const onDrop = (stage: LeadStage) => {
    if (!dragId) return;
    setLeads((ls) => ls.map((l) => (l.id === dragId ? { ...l, stage } : l)));
    setDragId(null);
    toast.success(`Moved to ${stage}`);
  };

  const reassign = (id: string, salesperson: string) => {
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, salesperson } : l)));
    if (active && active.id === id) setActive({ ...active, salesperson });
    toast.success("Reassigned");
  };

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle={`${leads.length} leads · drag cards between columns`}
        actions={<Button className="bg-primary hover:bg-primary-hover"><Plus className="h-4 w-4" />New Lead</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const stageLeads = leads.filter((l) => l.stage === stage);
          return (
            <div
              key={stage}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(stage)}
              className="bg-muted/50 rounded-lg p-2 min-h-[400px] min-w-[240px]"
            >
              <div className="flex items-center justify-between px-2 py-2 mb-2">
                <div className="font-bold text-sm">{stage}</div>
                <Badge variant="secondary" className="text-[11px]">{stageLeads.length}</Badge>
              </div>
              <div className="space-y-2">
                {stageLeads.map((l) => (
                  <Card
                    key={l.id}
                    draggable
                    onDragStart={() => setDragId(l.id)}
                    onClick={() => setActive(l)}
                    className={`p-3 cursor-pointer hover:shadow-md transition-shadow border-t-4 ${STAGE_COLORS[stage]}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-sm">{l.name}</div>
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </div>
                    <div className="text-[11px] text-muted-foreground">{l.company}</div>
                    <div className="text-sm font-bold text-primary mt-2">{formatINR(l.value)}</div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><User className="h-3 w-3" />{l.salesperson.split(" ")[0]}</span>
                      <span className="flex items-center gap-1"><CalIcon className="h-3 w-3" />{l.nextCallDate}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Sheet open={!!active} onOpenChange={() => setActive(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle className="text-xl">{active.name}</SheetTitle>
                <div className="text-sm text-muted-foreground">{active.company} · {active.id}</div>
              </SheetHeader>
              <div className="mt-6 space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 border border-border rounded-lg"><div className="text-xs text-muted-foreground">Value</div><div className="font-bold text-primary">{formatINR(active.value)}</div></div>
                  <div className="p-3 border border-border rounded-lg"><div className="text-xs text-muted-foreground">Stage</div><div className="font-bold">{active.stage}</div></div>
                  <div className="p-3 border border-border rounded-lg"><div className="text-xs text-muted-foreground">Referrer</div><div className="font-semibold text-sm">{active.referrer}</div></div>
                  <div className="p-3 border border-border rounded-lg"><div className="text-xs text-muted-foreground">Next Call</div><div className="font-semibold text-sm">{active.nextCallDate}</div></div>
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Assigned to</label>
                  <Select value={active.salesperson} onValueChange={(v) => reassign(active.id, v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Neha Kapoor", "Rohan Das", "Sandeep Khurana"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <h4 className="font-bold text-sm mb-2">Communication Log</h4>
                  <div className="space-y-2">
                    {active.communicationLog.map((c, i) => (
                      <div key={i} className="p-3 border border-border rounded-lg">
                        <div className="flex items-center justify-between text-xs">
                          <Badge variant="outline">{c.type}</Badge>
                          <span className="text-muted-foreground">{c.date}</span>
                        </div>
                        <div className="text-sm mt-1">{c.note}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-sm mb-2">Action Items</h4>
                  <div className="space-y-2">
                    {active.actionItems.length === 0 ? <p className="text-sm text-muted-foreground">No pending actions.</p> :
                      active.actionItems.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 p-3 border border-border rounded-lg">
                          <input type="checkbox" defaultChecked={a.done} className="accent-primary" />
                          <div className="flex-1">
                            <div className="text-sm font-semibold">{a.task}</div>
                            <div className="text-xs text-muted-foreground">Due {a.due}</div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Leads;
