import { NextRequest, NextResponse } from "next/server";
import {
  loadDistricts,
  loadEndorsements,
  geocodeAddress,
  checkJurisdiction,
  lookupDistricts,
  getEndorsements,
  getDistrictShapes,
} from "@/lib/services";
import { LookupResponse } from "@/lib/types";
import { APP_CONFIG } from "@/lib/app-config";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get("address");
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");

  // Validate input
  if (!address && (!latParam || !lngParam)) {
    return NextResponse.json(
      { error: "Either 'address' or both 'lat' and 'lng' must be provided" },
      { status: 400 }
    );
  }

  let lat: number;
  let lng: number;
  let addressUsed: string | null = null;

  // Geocode if address provided
  if (address) {
    try {
      const result = await geocodeAddress(address);
      lat = result.lat;
      lng = result.lng;
      addressUsed = result.matchedAddress;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Geocoding failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  } else {
    lat = parseFloat(latParam!);
    lng = parseFloat(lngParam!);

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: "Invalid latitude or longitude" },
        { status: 400 }
      );
    }
  }

  // Check if in configured jurisdiction.
  if (!checkJurisdiction(lat, lng)) {
    return NextResponse.json(
      { error: `Address is outside ${APP_CONFIG.geography.jurisdictionName}` },
      { status: 400 }
    );
  }

  // Load data and perform lookups
  const districtsData = loadDistricts();
  const endorsementsData = loadEndorsements();

  const districts = lookupDistricts(lat, lng, districtsData);
  const endorsements = getEndorsements(districts, endorsementsData);
  const district_shapes = APP_CONFIG.ui.showDistrictShapes
    ? getDistrictShapes(districts, districtsData)
    : undefined;

  const response: LookupResponse = {
    address_used: addressUsed,
    coordinates: { lat, lng },
    districts,
    endorsements,
    district_shapes,
  };

  return NextResponse.json(response);
}
