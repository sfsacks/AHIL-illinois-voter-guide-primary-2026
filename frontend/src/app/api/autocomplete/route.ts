import { NextRequest, NextResponse } from "next/server";
import { getGeocodingClient } from "@/lib/geocoding";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";

  if (query.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const geocoder = getGeocodingClient();
    const suggestions = await geocoder.autocompleteAddress(query);
    return NextResponse.json({ suggestions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Autocomplete failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
