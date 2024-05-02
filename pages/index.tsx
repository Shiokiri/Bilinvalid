import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

export default function IndexPage() {
  const startSpider = trpc.spider.startByConfigId.useMutation({
    onSuccess: () => {},
  });
  return (
    <div>
      <Button
        onClick={() => {
          startSpider.mutate({ configId: "clvpayhq6000008k19vvl7wse" });
        }}
      >
        Button
      </Button>
    </div>
  );
}
