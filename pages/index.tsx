import { trpc } from "../utils/trpc";
export default function IndexPage() {
  const spider = trpc.spider.useQuery();
  if (!spider.data) {
    return <div>Loading...</div>;
  }
  return (
    <div>
      <p>{spider.data.message}</p>
    </div>
  );
}
