import { redirect } from "next/navigation";

// Entry point — send everyone to the dashboard; the proxy bounces unauthed
// users to /login.
export default function Home() {
  redirect("/dashboard");
}
