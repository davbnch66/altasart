/**
 * Factur-X / ZUGFeRD XML generator (Minimum profile)
 * Generates CII (Cross Industry Invoice) XML conforming to EN16931
 * for Chorus Pro / public market compatibility.
 */

export interface FacturXData {
  invoiceNumber: string;
  issueDate: string; // YYYY-MM-DD
  dueDate?: string;
  currency?: string;
  // Seller
  sellerName: string;
  sellerSiret?: string;
  sellerTvaIntra?: string;
  sellerAddress?: string;
  sellerCity?: string;
  sellerPostalCode?: string;
  sellerCountry?: string; // ISO 3166-1 alpha-2
  sellerEmail?: string;
  // Buyer
  buyerName: string;
  buyerSiret?: string;
  buyerTvaIntra?: string;
  buyerAddress?: string;
  buyerCity?: string;
  buyerPostalCode?: string;
  buyerCountry?: string;
  buyerEmail?: string;
  // Totals
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  tvaRate: number; // e.g. 20 for 20%
  // Lines (optional for MINIMUM profile, included for BASIC)
  lines?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    tvaRate: number;
  }>;
  // Payment
  paymentMeans?: string; // e.g. "30" = virement
  iban?: string;
  bic?: string;
  // Chorus Pro
  serviceCode?: string; // Code service destinataire
  engagementNumber?: string; // Numéro d'engagement
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

export function generateFacturXXml(data: FacturXData): string {
  const currency = data.currency || "EUR";
  const country = data.sellerCountry || "FR";
  const buyerCountry = data.buyerCountry || "FR";

  const lines = data.lines || [];
  const hasLines = lines.length > 0;

  let lineItems = "";
  if (hasLines) {
    lines.forEach((line, idx) => {
      lineItems += `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${idx + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${escapeXml(line.description)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${line.unitPrice.toFixed(2)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="C62">${line.quantity.toFixed(2)}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>S</ram:CategoryCode>
          <ram:RateApplicablePercent>${line.tvaRate.toFixed(2)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${line.total.toFixed(2)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:${hasLines ? "basic" : "minimum"}</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${escapeXml(data.invoiceNumber)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${formatDate(data.issueDate)}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>${lineItems}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${escapeXml(data.sellerName)}</ram:Name>${data.sellerSiret ? `
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${escapeXml(data.sellerSiret)}</ram:ID>
        </ram:SpecifiedLegalOrganization>` : ""}
        <ram:PostalTradeAddress>
          ${data.sellerAddress ? `<ram:LineOne>${escapeXml(data.sellerAddress)}</ram:LineOne>` : ""}
          ${data.sellerPostalCode ? `<ram:PostcodeCode>${escapeXml(data.sellerPostalCode)}</ram:PostcodeCode>` : ""}
          ${data.sellerCity ? `<ram:CityName>${escapeXml(data.sellerCity)}</ram:CityName>` : ""}
          <ram:CountryID>${country}</ram:CountryID>
        </ram:PostalTradeAddress>${data.sellerTvaIntra ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${escapeXml(data.sellerTvaIntra)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ""}${data.sellerEmail ? `
        <ram:URIUniversalCommunication>
          <ram:URIID schemeID="EM">${escapeXml(data.sellerEmail)}</ram:URIID>
        </ram:URIUniversalCommunication>` : ""}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${escapeXml(data.buyerName)}</ram:Name>${data.buyerSiret ? `
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${escapeXml(data.buyerSiret)}</ram:ID>
        </ram:SpecifiedLegalOrganization>` : ""}
        <ram:PostalTradeAddress>
          ${data.buyerAddress ? `<ram:LineOne>${escapeXml(data.buyerAddress)}</ram:LineOne>` : ""}
          ${data.buyerPostalCode ? `<ram:PostcodeCode>${escapeXml(data.buyerPostalCode)}</ram:PostcodeCode>` : ""}
          ${data.buyerCity ? `<ram:CityName>${escapeXml(data.buyerCity)}</ram:CityName>` : ""}
          <ram:CountryID>${buyerCountry}</ram:CountryID>
        </ram:PostalTradeAddress>${data.buyerTvaIntra ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${escapeXml(data.buyerTvaIntra)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ""}
      </ram:BuyerTradeParty>${data.engagementNumber ? `
      <ram:BuyerOrderReferencedDocument>
        <ram:IssuerAssignedID>${escapeXml(data.engagementNumber)}</ram:IssuerAssignedID>
      </ram:BuyerOrderReferencedDocument>` : ""}
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${currency}</ram:InvoiceCurrencyCode>${data.paymentMeans ? `
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>${escapeXml(data.paymentMeans)}</ram:TypeCode>${data.iban ? `
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${escapeXml(data.iban)}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>` : ""}${data.bic ? `
        <ram:PayeeSpecifiedCreditorFinancialInstitution>
          <ram:BICID>${escapeXml(data.bic)}</ram:BICID>
        </ram:PayeeSpecifiedCreditorFinancialInstitution>` : ""}
      </ram:SpecifiedTradeSettlementPaymentMeans>` : ""}
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${data.totalTVA.toFixed(2)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${data.totalHT.toFixed(2)}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>${data.tvaRate.toFixed(2)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>${data.dueDate ? `
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${formatDate(data.dueDate)}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>` : ""}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${data.totalHT.toFixed(2)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${data.totalHT.toFixed(2)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${currency}">${data.totalTVA.toFixed(2)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${data.totalTTC.toFixed(2)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${data.totalTTC.toFixed(2)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

  return xml;
}

/**
 * Download the Factur-X XML as a file
 */
export function downloadFacturXXml(data: FacturXData): void {
  const xml = generateFacturXXml(data);
  const blob = new Blob([xml], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `factur-x_${data.invoiceNumber}.xml`;
  a.click();
  URL.revokeObjectURL(url);
}
