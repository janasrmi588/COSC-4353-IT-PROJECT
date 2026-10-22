const API_URL = "http://localhost:3001/api/services";

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

function withEmail(adminEmail) {
  return adminEmail ? `?email=${encodeURIComponent(adminEmail)}` : "";
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export function fetchServices() {
  return request(API_URL);
}

export function createService(adminEmail, values) {
  return request(`${API_URL}${withEmail(adminEmail)}`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(values),
  });
}

export function updateService(adminEmail, id, values) {
  return request(`${API_URL}/${id}${withEmail(adminEmail)}`, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(values),
  });
}

export function deleteService(adminEmail, id) {
  return request(`${API_URL}/${id}${withEmail(adminEmail)}`, {
    method: "DELETE",
  });
}
