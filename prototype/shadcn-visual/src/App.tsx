import { ProtoBoard } from "@/proto/board";
import { ThemeSwitcher } from "@/proto/switcher";

function App() {
  const theme = new URLSearchParams(window.location.search).get("theme") ?? "a";
  document.documentElement.dataset.proto = theme;
  return (
    <>
      <ProtoBoard />
      <ThemeSwitcher current={theme} />
    </>
  );
}

export default App;
