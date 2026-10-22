import { users } from "../../data/store.js";

export function registerUser(email, password) {
  if (!email || !password) {
    return {
      success: false,
      status: 400,
      message: "Email and password are required.",
    };
  }

  const existingUser = users.find(
    (user) => user.email.toLowerCase() === email.toLowerCase()
  );

  if (existingUser) {
    return {
      success: false,
      status: 409,
      message: "An account with this email already exists.",
    };
  }

  const newUser = {
    id: users.length + 1,
    email: email.toLowerCase(),
    password,
    role: "user",
  };

  users.push(newUser);

  return {
    success: true,
    status: 201,
    user: {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
    },
  };
}

export function loginUser(email, password) {
  if (!email || !password) {
    return {
      success: false,
      status: 400,
      message: "Email and password are required.",
    };
  }

  const user = users.find(
    (user) => user.email.toLowerCase() === email.toLowerCase()
  );

  if (!user || user.password !== password) {
    return {
      success: false,
      status: 401,
      message: "Invalid email or password.",
    };
  }

  return {
    success: true,
    status: 200,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  };
}