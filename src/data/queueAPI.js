const API_URL = "http://localhost:3001/api/queue";

async function request(url, options) {
  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      const message = data.details
        ? Object.values(data.details).join(" ")
        : data.message;
      return { ok: false, message: message || "Something went wrong." };
    }
    return { ok: true, ...data };
  } catch {
    return { ok: false, message: "Unable to connect to the server." };
  }
}

function withEmail(email, extra = "") {
  return `?email=${encodeURIComponent(email ?? "")}${extra}`;
}

const JSON_HEADERS = { "Content-Type": "application/json" };


export function fetchMyQueues(userEmail) {
  return request(`${API_URL}/mine${withEmail(userEmail)}`);
}

export function joinQueue(userEmail, serviceId) {
  return request(`${API_URL}/join${withEmail(userEmail)}`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ serviceId }),
  });
}

export function leaveQueue(userEmail, entryId) {
  return request(`${API_URL}/${entryId}/leave${withEmail(userEmail)}`, {
    method: "POST",
  });
}

export function fetchQueue(adminEmail, serviceId) {
  const extra = serviceId ? `&serviceId=${encodeURIComponent(serviceId)}` : "";
  return request(`${API_URL}${withEmail(adminEmail, extra)}`);
}

export function serveNextUser(adminEmail, serviceId) {
  return request(`${API_URL}/serve-next${withEmail(adminEmail)}`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(serviceId ? { serviceId } : {}),
  });
}
