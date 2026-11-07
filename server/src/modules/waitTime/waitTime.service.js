// Wait-time estimation. Basic and rule-based is fine (for example position x expected duration).
export function estimateWait(line, index, serviceList = []) {
    const minutesByService = new Map(
        serviceList.map((service) => [
            String(service.id ?? service._id),
            service.expectedDuration,
        ]),
    );

    let total = 0;
    for (let i = 0; i < index; i++) {
        const minutes = minutesByService.get(String(line[i]?.serviceId));
        total += Number.isFinite(minutes) ? minutes : 0;
    }
    return total;
}
