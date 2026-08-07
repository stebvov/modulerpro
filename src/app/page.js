import AppShell from "@/components/AppShell";
import { DataProvider } from "@/context/DataContext";

export default function HomePage() {
  return (
    <DataProvider>
      <AppShell />
    </DataProvider>
  );
}
