import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Settled-With picker source of truth = the "Settlement Contacts" reference list
// (ReferenceEntity type "individual"). Contact fields (email/phone/company/role) live in
// ReferenceEntity.details; search matches displayName + aliases (aliases include email and
// "name company", so those remain searchable).

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function detailStr(details: unknown, key: string): string {
  if (details && typeof details === "object" && !Array.isArray(details)) {
    return clean((details as Record<string, unknown>)[key]);
  }
  return "";
}

function contactDisplay(name: string, email: string): string {
  if (name && email) return `${name} <${email}>`;
  return name || email || "";
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const query = clean(url.searchParams.get("q"));
    const includeInactive = clean(url.searchParams.get("includeInactive")).toLowerCase() === "true";

    const entities = await prisma.referenceEntity.findMany({
      where: {
        type: "individual",
        ...(includeInactive ? {} : { active: true }),
        ...(query
          ? {
              OR: [
                { displayName: { contains: query, mode: "insensitive" } },
                { aliases: { some: { alias: { contains: query, mode: "insensitive" } } } },
              ],
            }
          : {}),
      },
      orderBy: [{ displayName: "asc" }],
      take: 50,
    });

    const contacts = entities.map((entity) => {
      const name = clean(entity.displayName);
      const email = detailStr(entity.details, "email");
      return {
        id: entity.id,
        name,
        email,
        phone: detailStr(entity.details, "phone"),
        company: detailStr(entity.details, "company"),
        role: detailStr(entity.details, "role") || "Settled With",
        notes: clean(entity.notes),
        isActive: entity.active,
        type: "individual",
        display: contactDisplay(name, email),
      };
    });

    return NextResponse.json({
      ok: true,
      action: "settlement-contacts-list",
      localFirst: true,
      sourceOfTruth: "barsh-matters-local",
      count: contacts.length,
      contacts,
      safety: {
        readOnly: true,
        clioRecordsChanged: false,
        databaseRecordsChanged: false,
        documentsGenerated: false,
        printQueueChanged: false,
        mattersClosed: false,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "settlement-contacts-list",
        localFirst: true,
        sourceOfTruth: "barsh-matters-local",
        error: error?.message || "Settlement contact lookup failed.",
        contacts: [],
        safety: {
          readOnly: true,
          clioRecordsChanged: false,
          databaseRecordsChanged: false,
          documentsGenerated: false,
          printQueueChanged: false,
          mattersClosed: false,
        },
      },
      { status: 500 }
    );
  }
}
