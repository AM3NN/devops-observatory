import type { LucideIcon } from "lucide-react";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PageStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

export function PageState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: PageStateProps) {
  return (
    <div className={cn("mx-auto", className)}>
      <div className="glass-panel rounded-2xl p-8">
        <Empty className="border-0 p-0">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-primary/10 text-primary">
              <Icon className="size-6" />
            </EmptyMedia>
            <EmptyTitle className="text-slate-100">{title}</EmptyTitle>
            <EmptyDescription className="text-slate-400">
              {description}
            </EmptyDescription>
          </EmptyHeader>
          {actionLabel && onAction ? (
            <EmptyContent>
              <Button variant="outline" onClick={onAction}>
                {actionLabel}
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      </div>
    </div>
  );
}
