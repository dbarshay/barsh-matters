import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function contactDisplay(contact: any): string {
  const name = clean(contact?.name);
  const email = clean(contact?.email);
  if (name && email) return `${name} <${email}>`;
  return name || email || "";
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const query = clean(url.searchParams.get("q"));
    const includeInactive = clean(url.searchParams.get("includeInactive")).toLowerCase() === "true";

    const contacts = await prisma.settlementContact.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" } },
                { email: { contains: query, mode: "insensitive" } },
                { company: { contains: query, mode: "insensitive" } },
                { role: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [
        { name: "asc" },
        { email: "asc" },
      ],
      take: 50,
    });

    return NextResponse.json({
      ok: true,
      action: "settlement-contacts-list",
      localFirst: true,
      sourceOfTruth: "barsh-matters-local",
      count: contacts.length,
      contacts: contacts.map((contact) => ({
        id: contact.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        role: contact.role,
        notes: contact.notes,
        isActive: contact.isActive,
        display: contactDisplay(contact),
      })),
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
