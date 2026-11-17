import { demoMode, officialUrl } from "@/lib/site";

/*--Shown on every page of the demo copy, so nobody mistakes it for the official BSREA website--*/
export default function DemoBanner() {
  if (!demoMode) return null;
  return (
    <div role="note" className="bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-gray-900">
      Demo project – this is not the official BSREA website. The official site is{" "}
      <a href={officialUrl} className="underline underline-offset-2">
        bsreabd.org
      </a>
      .
    </div>
  );
}

/*--A note above forms in the demo copy: nothing sent here reaches BSREA--*/
export function DemoFormNotice() {
  if (!demoMode) return null;
  return (
    <p role="note" className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <strong>Demo only:</strong> this form is part of a demo project and does not reach BSREA. Please don&apos;t
      enter real personal details or upload real documents. To contact or join BSREA, use{" "}
      <a href={officialUrl} className="font-semibold underline">
        bsreabd.org
      </a>
      .
    </p>
  );
}
