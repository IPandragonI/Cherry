import { TabBar } from "@/components/ui/TabBar";

export default function TabsLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main
        className="mx-auto flex min-h-dvh w-full max-w-md flex-col"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "calc(84px + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </main>
      <TabBar />
    </>
  );
}
