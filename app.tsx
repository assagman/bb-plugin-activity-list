// bb-plugin-activity-list frontend entry.
//
// Registers one replacement for the sidebar's thread list. bb keeps its own
// list as the bundled thread-list plugin; the user picks between them under
// Settings → Appearance → Sidebar, so this plugin never removes bb's list.
import { definePluginApp } from "@get-bb/plugin-sdk/app";
import { ActivityList } from "./src/ActivityList.tsx";

export default definePluginApp((app) => {
  app.slots.experimental_threadList({
    id: "activity",
    title: "Activity list",
    description:
      "Projects and threads sorted by latest activity, with colored status cues and status filters.",
    component: ActivityList,
  });
});
