import meetingFull from "../starters/Meeting full (with transcript).md";
import meetingNotes from "../starters/Meeting notes.md";
import meetingRecap from "../starters/Meeting recap.md";
import meetingTracker from "../starters/Meeting tracker.md";
import weeklyReview from "../starters/Weekly review.md";
import { starterHash, type StarterDef } from "./core/starters-plan";

/**
 * Bundled starter presets. When a starter changes: bump its `starter-version` (in the file and
 * here) and append the hash of the PREVIOUS content to `previous`, so unmodified copies of
 * older versions are recognized and upgraded.
 */
function def(
  name: string,
  file: string,
  version: number,
  content: string,
  previous: string[] = [],
): StarterDef {
  return { name, file, version, content, shippedHashes: [...previous, starterHash(content)] };
}

export const STARTERS: readonly StarterDef[] = [
  def("Meeting notes", "Meeting notes.md", 3, meetingNotes, ["f97954e4", "f6343d4e"]),
  def("Meeting recap", "Meeting recap.md", 3, meetingRecap, ["85e27c84", "558971de"]),
  def("Meeting full (with transcript)", "Meeting full (with transcript).md", 3, meetingFull, [
    "60985100",
    "9c44a172",
  ]),
  def("Meeting tracker", "Meeting tracker.md", 1, meetingTracker),
  def("Weekly review", "Weekly review.md", 2, weeklyReview, ["df82f29d"]),
];
