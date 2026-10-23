// Wait-time estimation. Basic and rule-based is fine (for example position x expected duration).
import { services } from "../../data/store.js";

export function estimateWait(line, index, serviceList = services) {
    let total = 0;
    for (let i = 0; i < index; i++) {
        const service = serviceList.find((s) => s.id === line[i].serviceId);
        total += service?.expectedDuration ?? 0;
    }
    return total;
}
