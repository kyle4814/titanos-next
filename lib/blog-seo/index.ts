import type { BlogPost } from "../blog";
import { post as missedCall } from "./missed-call-spam-act";
import { post as quoteFollowUp } from "./quote-follow-up";
import { post as aiReceptionist } from "./ai-receptionist-privacy";
import { post as callRecording } from "./call-recording";
import { post as breachEmail } from "./breach-email";
import { post as e8Cost } from "./e8-cost";
import { post as admWording } from "./adm-wording";
import { post as austender } from "./austender";

/** SEO push 2026-11-28: eight long-form posts for P1 terms in the SEO audit. */
export const SEO_POSTS: BlogPost[] = [missedCall, quoteFollowUp, aiReceptionist, callRecording, breachEmail, e8Cost, admWording, austender];
