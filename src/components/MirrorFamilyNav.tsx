const FAMILY = [
  { key: "pilot",       label: "Pilot",       href: "https://mirror-pilot.musicailab.com",       blurb: "wallet personality" },
  { key: "deployer",    label: "Deployer",    href: "https://mirror-deployer.musicailab.com",    blurb: "deployer reputation" },
  { key: "marketplace", label: "Marketplace", href: "https://mirror-marketplace.musicailab.com", blurb: "trader subscriptions" },
  { key: "journal",     label: "Journal",     href: "https://journal-copilot.musicailab.com",    blurb: "auto trade journal" },
];

export default function MirrorFamilyNav({ current }: { current: "pilot" | "deployer" | "marketplace" | "journal" }) {
  return (
    <nav className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-2 overflow-x-auto">
        <span className="text-xs font-medium text-muted-foreground shrink-0 mr-1">🪞 Mirror Family</span>
        <span className="text-muted-foreground/40 shrink-0 mr-1">·</span>
        {FAMILY.map((f) => {
          const active = f.key === current;
          return (
            <a
              key={f.key}
              href={f.href}
              title={f.blurb}
              className={
                "shrink-0 text-xs px-2.5 py-1 rounded-md transition-colors " +
                (active
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60")
              }
            >
              {f.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
