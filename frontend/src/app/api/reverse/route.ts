import { NextRequest, NextResponse } from "next/server";
import { getGeocodingClient } from "@/lib/geocoding";

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: "Invalid latitude or longitude" }, { status: 400 });
  }

  try {
    const geocoder = getGeocodingClient();
    const address = await geocoder.reverseGeocode(lat, lng);
    return NextResponse.json({ address });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reverse geocoding failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
