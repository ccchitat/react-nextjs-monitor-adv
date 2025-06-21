import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import SignOut from "./sign-out";

export default async function AuthStatus() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg border">
      <span className="text-sm text-gray-600">
        已登录：{session.user?.username}
      </span>
      <SignOut />
    </div>
  );
}
