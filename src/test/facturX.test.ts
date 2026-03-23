import { describe, it, expect } from "vitest";
import { generateFacturXXml, type FacturXData } from "@/lib/generateFacturX";

const baseData: FacturXData = {
  invoiceNumber: "FAC-2026-001",
  issueDate: "2026-03-15",
  dueDate: "2026-04-15",
  sellerName: "AltasArt SAS",
  sellerSiret: "12345678900010",
  sellerTvaIntra: "FR12345678900",
  sellerAddress: "10 rue du Port",
  sellerCity: "Lyon",
  sellerPostalCode: "69002",
  sellerEmail: "contact@altasart.fr",
  buyerName: "Client Test SARL",
  buyerSiret: "98765432100020",
  buyerAddress: "5 avenue de la République",
  buyerCity: "Paris",
  buyerPostalCode: "75011",
  totalHT: 1000,
  totalTVA: 200,
  totalTTC: 1200,
  tvaRate: 20,
};

describe("generateFacturXXml", () => {
  it("generates valid XML with required namespaces", () => {
    const xml = generateFacturXXml(baseData);
    expect(xml).toContain('xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"');
    expect(xml).toContain('xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"');
  });

  it("includes invoice number and type code 380", () => {
    const xml = generateFacturXXml(baseData);
    expect(xml).toContain("<ram:ID>FAC-2026-001</ram:ID>");
    expect(xml).toContain("<ram:TypeCode>380</ram:TypeCode>");
  });

  it("formats dates as YYYYMMDD with format 102", () => {
    const xml = generateFacturXXml(baseData);
    expect(xml).toContain('format="102">20260315</udt:DateTimeString>');
    expect(xml).toContain('format="102">20260415</udt:DateTimeString>');
  });

  it("includes seller SIRET with schemeID 0002", () => {
    const xml = generateFacturXXml(baseData);
    expect(xml).toContain('schemeID="0002">12345678900010</ram:ID>');
  });

  it("includes TVA amounts and rate", () => {
    const xml = generateFacturXXml(baseData);
    expect(xml).toContain("<ram:CalculatedAmount>200.00</ram:CalculatedAmount>");
    expect(xml).toContain("<ram:BasisAmount>1000.00</ram:BasisAmount>");
    expect(xml).toContain("<ram:RateApplicablePercent>20.00</ram:RateApplicablePercent>");
    expect(xml).toContain("<ram:GrandTotalAmount>1200.00</ram:GrandTotalAmount>");
  });

  it("uses MINIMUM profile when no lines provided", () => {
    const xml = generateFacturXXml(baseData);
    expect(xml).toContain("urn:factur-x.eu:1p0:minimum");
  });

  it("uses BASIC profile and renders line items when lines provided", () => {
    const data: FacturXData = {
      ...baseData,
      lines: [
        { description: "Transport grue 50T", quantity: 2, unitPrice: 500, total: 1000, tvaRate: 20 },
      ],
    };
    const xml = generateFacturXXml(data);
    expect(xml).toContain("urn:factur-x.eu:1p0:basic");
    expect(xml).toContain("<ram:Name>Transport grue 50T</ram:Name>");
    expect(xml).toContain("<ram:LineID>1</ram:LineID>");
    expect(xml).toContain("<ram:LineTotalAmount>1000.00</ram:LineTotalAmount>");
  });

  it("escapes XML special characters", () => {
    const data: FacturXData = {
      ...baseData,
      sellerName: "Test & Co <SA>",
    };
    const xml = generateFacturXXml(data);
    expect(xml).toContain("Test &amp; Co &lt;SA&gt;");
    expect(xml).not.toContain("Test & Co <SA>");
  });

  it("includes IBAN/BIC when payment means provided", () => {
    const data: FacturXData = {
      ...baseData,
      paymentMeans: "30",
      iban: "FR7630001007941234567890185",
      bic: "BNPAFRPP",
    };
    const xml = generateFacturXXml(data);
    expect(xml).toContain("<ram:TypeCode>30</ram:TypeCode>");
    expect(xml).toContain("<ram:IBANID>FR7630001007941234567890185</ram:IBANID>");
    expect(xml).toContain("<ram:BICID>BNPAFRPP</ram:BICID>");
  });

  it("includes engagement number for Chorus Pro", () => {
    const data: FacturXData = {
      ...baseData,
      engagementNumber: "ENG-2026-42",
    };
    const xml = generateFacturXXml(data);
    expect(xml).toContain("<ram:IssuerAssignedID>ENG-2026-42</ram:IssuerAssignedID>");
  });
});
