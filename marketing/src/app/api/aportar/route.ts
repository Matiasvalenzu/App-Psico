import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const backendUrl =
      process.env.INTERNAL_BACKEND_URL ||
      process.env.BACKEND_API_URL ||
      (process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api`
        : "http://backend:8000/api")

    const res = await fetch(`${backendUrl}/feedback/aportar/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudo conectar con el servidor para enviar tu aporte." },
      { status: 500 }
    )
  }
}
