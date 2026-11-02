import { DATA } from "../data.js";
import { makeIsLv } from "./is_lv.js";
import { makeIsHv } from "./is_hv.js";
import { makeIecLv } from "./iec_lv.js";

export const ADAPTERS = {};
ADAPTERS["LV-IS"] = makeIsLv(DATA);
if (DATA.hvIs) ADAPTERS["HV-IS"] = makeIsHv(DATA);
if (DATA.iec) ADAPTERS["LV-IEC"] = makeIecLv(DATA);
export { DATA };
