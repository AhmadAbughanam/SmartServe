"use client";

import { useRouter } from "next/navigation";
import { CustomerOtpLogin } from "../../../components/customer-otp-login";

export default function CustomerLoginPage() {
  const router = useRouter();
  return <CustomerOtpLogin onBack={() => router.push("/customer")} />;
}
