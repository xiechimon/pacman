// Board route shell (issue #53): geometry and components land in #54/#55,
// which consume the scenario-selected fixture set. Renders the app
// surface with the horizontal board scroller element the parity harness
// drives via scrollLeft (data-parity-scroll).
export function BoardPage() {
  return (
    <div className="h-full overflow-hidden bg-surface text-content" data-route="board">
      <div className="h-full overflow-x-auto overflow-y-hidden" data-parity-scroll="" />
    </div>
  );
}
