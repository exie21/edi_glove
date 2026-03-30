import type { PropsWithChildren, ReactNode } from 'react';

interface PanelCardProps extends PropsWithChildren {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
}

export function PanelCard({
  title,
  eyebrow,
  action,
  children,
}: PanelCardProps) {
  return (
    <section className="panel-card">
      <header className="panel-card__header">
        <div>
          {eyebrow ? <p className="panel-card__eyebrow">{eyebrow}</p> : null}
          <h2 className="panel-card__title">{title}</h2>
        </div>
        {action ? <div className="panel-card__action">{action}</div> : null}
      </header>
      <div className="panel-card__body">{children}</div>
    </section>
  );
}

