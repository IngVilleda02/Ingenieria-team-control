import type { Ctx } from "./context";
import { activityOptions } from "./services/activities";
import { memberOptions } from "./services/members";
import { phaseOptions, projectOptions } from "./services/projects";
import { getSetting } from "./services/settings";
import { todayIn } from "./services/metrics";

export async function formOptions(c: Ctx) {
  const [members, projects, phases, activities, tz] = await Promise.all([
    memberOptions(c), projectOptions(c), phaseOptions(c), activityOptions(c), getSetting("timezone"),
  ]);
  return { members, projects, phases, activities, today: todayIn(tz), tz };
}
