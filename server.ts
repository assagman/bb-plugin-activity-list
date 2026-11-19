// bb-plugin-activity-list backend entry.
//
// bb requires every plugin to declare a server entry. The list reads bb's live
// sidebar state in the browser and keeps its collapse and filter choices per
// client, so the backend intentionally does nothing.
import type { BbPluginApi } from "@get-bb/plugin-sdk";

/** Required backend entry; registers nothing. */
export default function activityListPlugin(_bb: BbPluginApi): void {}
