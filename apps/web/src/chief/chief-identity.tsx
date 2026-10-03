// Chief drawer robot-row identity chip (#741): avatar + name side by side,
// the whole chip one router Link into the agent's settings page. Reference
// canon (todos.dev, live-captured 2026-10-03 — issue #741): the identity
// chip is cursor-pointer across the board (name span and wrapper alike),
// hover changes only the cursor (no background state), and click routes
// same-tab to /app/resources/agents/<id>. The anchor form keeps keyboard
// activation, middle-click and open-in-new-tab for free (#675 recipe).
//
// ChiefContent.agent.id is an optional slot (#444 envelope): the live mapper
// always carries it, but fixture captures without an id must render an inert
// non-link (zero-navigation capture guarantee) — same face, no anchor. The
// avatar slot keeps the XMON-105 single source (SeededAvatar, 24px canon via
// .chief-avatar--img in chief.css).

import { Link, useLocation } from 'react-router';

import { SeededAvatar } from '../components/ui/seeded-avatar.js';
import type { ChiefContent } from '../fixtures/records.js';
import { AGENTS_HREF } from '../routes/agent-detail-page.js';

interface ChiefIdentityProps {
  agent: NonNullable<ChiefContent['agent']>;
}

export function ChiefIdentity({ agent }: ChiefIdentityProps) {
  // #121 Link law: the scenario param rides along so fixture-mode clicks
  // land on a detail page that resolves the same corpus (team-page agent
  // card recipe). Live URLs carry no scenario — search is empty there.
  const { search } = useLocation();
  const face = (
    <>
      <span className="chief-avatar chief-avatar--img">
        <SeededAvatar
          name={agent.displayName}
          src={agent.avatarUrl}
          fallback="/avatar-robot-1.svg"
        />
      </span>
      <span className="chief-identity-name">{agent.displayName}</span>
    </>
  );
  if (agent.id == null) return <span className="chief-identity">{face}</span>;
  return (
    <Link className="chief-identity" to={{ pathname: `${AGENTS_HREF}/${agent.id}`, search }}>
      {face}
    </Link>
  );
}
