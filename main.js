const VK = require("vk-io").VK;
const axios = require("axios");
const fsPromises = require("fs").promises;
const PdfParse = require("pdf-parse");
const stringify = require("csv-stringify/lib/sync")

const vk = new VK({
    token: process.env.TOKEN || ""
});

async function parsePdf(pdfData) {
    const pdf = await PdfParse(pdfData, {
        pagerender: async (pageData) => {
            const result = await pageData.getTextContent({
                normalizeWhitespaces: true,
                disableCombineTextItems: true
            });
            return result.items.map(item => item.str.replace(/\t/g, "    ").trim()).filter(item => item.length > 0).join("\n") + "\n\t";
        }
    });
    console.info("Parsing done");
    const data = pdf.text.trim().split("\n\t\n\n").map(item => item.split("\n"));
    let result = null;
    if (data[0][0] === "Сертификат о профилактических прививках против новой коронавирусной инфекции") {
        result = {};
        let index = 3;
        result.dateOfBirth = data[0][index++];
        result.gender = data[0][index++];
        index++;
        index++;
        result.fullName = data[0][index++];
        result.address = "";
        index++;
        index++;
        for (; data[0][index] != "Паспорт"; index++) {
            result.address += data[0][index] + " ";
        }
        result.address = result.address.trim();
        index++;
        result.passport = data[0][index++];
        index++;
        result.snils = data[0][index++];
        index++;
        result.otherPassport = data[0][index++];
        index++;
        index++;
        result.oms = "";
        for (; data[0][index] != "Информация о профилактических прививках против новой"; index++) {
            result.oms += data[0][index] + " ";
        }
        result.oms = result.oms.trim();
    } else if (data[0][0] === "Сертификат о вакцинации COVID-19") {
        result = {};
        result.fullName = data[0][2];
        result.dateOfBirth = data[0][3];
        result.gender = data[0][4];
        result.passport = data[1][10];
        result.otherPassport = data[1][13] === "Not specified" ? "-" : data[1][13];
    } else if (data[0][0] === "Сертификат профилактической прививки от COVID-19") {
        result = {};
        result.fullName = data[0][2];
        result.dateOfBirth = data[0][3];
        result.gender = data[0][4];
        result.passport = data[1][10];
        result.otherPassport = data[1][13] === "Not specified" ? "-" : data[1][13];
    } else if (data[0][0] === "Сведения о перенесенных заболеваниях COVID-19") {
        result = {};
        result.fullName = data[0][2];
        result.dateOfBirth = data[0][3];
        result.gender = data[0][4];
        result.passport = data[0][12];
        result.snils = data[0][13];
        result.oms = data[0][14];
        result.otherPassport = data[1][13] === "Not specified" ? "-" : data[1][13];
    } else if (data[0][0] === "Certificate of immunization against the novel coronavirus infection COVID-19 or medical") {
        result = {};
        result.dateOfBirth = data[0][3];
        result.gender = data[0][4];
        result.fullName = data[0][7];
        result.address = data[0][10];
        result.passport = data[0][12];
        result.snils = data[0][14];
        result.oms = data[0][20];
        result.otherPassport = data[0][17];
    } else if (data[0][0] === "Временный сертификат о вакцинации COVID-19") {
        result = {};
        result.fullName = data[0][2];
        result.dateOfBirth = data[0][3];
        result.gender = data[0][4];
        result.passport = data[0][12];
    }
    if (!result) {
        console.info(data);
    }
    return result;
}

async function parsePdfFromUrl(url) {
    const document = await axios.get(url, {
        responseType: "arraybuffer",
        validateStatus: () => true,
        maxRedirects: 10
    });
    if (document.status !== 200) {
        console.error(`Error: ${document.status}`);
        return null;
    }
    try {
        console.info("Parsing");
        return await parsePdf(document.data);
    } catch (e) {
        console.error(e);
        return null;
    }
}

(async () => {
    /*
    // TEST ProfInj 
    console.info(await parsePdfFromUrl("https://vk.com/doc146901633_621880721?hash=51d189be7a24ee8e4f&dl=GE3TAMZVGY3DGMA:1636750888:48ddc469c8a8008abe&api=1&no_preview=1"));
    // TEST Vaccination 
    console.info(await parsePdfFromUrl("https://vk.com/doc489650588_620426591?hash=8315281d57e5d1c784&dl=GE3TAMZVGY3DGMA:1636750888:e5fe7efcac8e1bfd36&api=1&no_preview=1"));
    // TEST Illness 
    console.info(await parsePdfFromUrl("https://vk.com/doc154508695_618817689?hash=54cdd9c99173e70837&dl=GE3TAMZVGY3DGMA:1636750888:93a7eca5f364e02daa&api=1&no_preview=1"));
    // TEST Info about illness
    console.info(await parsePdfFromUrl("https://vk.com/doc671928992_620414867?hash=5f3b88e403c8677e40&dl=GE3TAMZVGY3DGMA:1636752190:676a059b6e3bd715b4&api=1&no_preview=1"));
    // TEST Other
    console.info(await parsePdfFromUrl("https://vk.com/doc254059041_614634272?hash=8d1808a715bb425721&dl=GE3TAMZVGY3DGMA:1636752190:577385240d6ee4b66b&api=1&no_preview=1"));
    // TEST Temporary certificate
    console.info(await parsePdfFromUrl("https://vk.com/doc573408928_619422589?hash=2fe48c7d62c71ca3cf&dl=GE3TAMZVGY3DGMA:1636753442:1662b68ba19c98af3a&api=1&no_preview=1"));
    // TEST Vaccination ENG
    console.info(await parsePdfFromUrl("https://vk.com/doc669721579_616473390?hash=49f1b9296194e9ac49&dl=GE3TAMZVGY3DGMA:1636753442:f92b34f6c1a332c300&api=1&no_preview=1"));
    return;
    // */

    const results = [];

    let total = 0;
    let current = 0;
    do {
        const docs = await vk.api.docs.search({
            q: "certif",
            count: 2000,
            offset: current
        });
        total = docs.count;
        current += docs.items.length;
        for (const doc of docs.items) {
            if (doc.ext === "pdf" && doc.title.indexOf("certificate_covid") !== -1 && doc.url !== undefined) {
                console.info(doc.url);
                const result = await parsePdfFromUrl(doc.url);
                if (result) {
                    result.vkId = doc.owner_id;
                }
                results.push(result);
                console.info(result);
            }
        }
    } while (current < total);

    await fsPromises.writeFile("results.csv", stringify(results.filter(result => result), {
        header: true
    }));
})().catch(console.error);