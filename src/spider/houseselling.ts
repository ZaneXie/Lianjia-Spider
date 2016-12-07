/**
 * Created by qing.he on 2016/12/6.
 */

import requestPromise = require("request-promise");
import cheerio = require("cheerio");
import {getDebugger} from "../util/debug";
import {inject, injectable} from 'inversify';
import {HouseManager, IHouseManager} from "../manager/house";
import {SERVICE_IDENTIFIER} from '../constants/ioc';
import {IComplexManager} from '../manager/complex';
let debug = getDebugger("spider");

export interface IHouseSellingSpider {
    run();
}

@injectable()
export class CDHouseSellingSpider implements IHouseSellingSpider {

    private houseManager: IHouseManager;
    private complexManager: IComplexManager;

    public constructor(@inject(SERVICE_IDENTIFIER.HouseManager) houseManager: IHouseManager,
                       @inject(SERVICE_IDENTIFIER.ComplexManager) complexManager: IComplexManager) {
        this.houseManager = houseManager;
        this.complexManager = complexManager;
    }

    async realParse(url: string, complexID: string){
        debug("parsing url: " + url);
        let html = await requestPromise(url);
        let $ = cheerio.load(html);
        let houses: {}[] = [];
        $(".main-box .house-lst li").each(function (key, ele) {
            let title = $(ele).find("h2 a").text().trim();
            let where = $(ele).find(".where a span").text().trim();

            let info = $(ele).find(".where span");
            let layout = $(info.get(1)).find("span").text().trim();
            let area = $(info.get(3)).text().trim();

            let location = $(ele).find(".other .con a").text().trim();
            let detail = $(ele).find(".other .con").text().trim();

            let totalPrice = $(ele).find(".price span").text().trim();
            let unitPrice = $(ele).find(".price-pre").text().trim();

            let visitorNum = $(ele).find(".square span").text().trim();

            let url = $(ele).find(".info-panel h2 a").attr("href");
            let pattern = /.*\/(.*)\.html/
            let match = pattern.exec(url);
            let id = "";
            if (match && match[1]) {
                id = match[1];
            }
            let pattern_price = /(\d+)/
            let match_price = pattern_price.exec(unitPrice);
            if (match_price && match_price[0]) {
                unitPrice = match_price[0];
            }
            let pattern_area = /(\d+\.?\d+)/
            let match_area = pattern_area.exec(area);
            if (match_area && match_area[0]) {
                area = match_area[0];
            }
            let house = {
                lj_id: id,
                url: url,
                title: title,
                complex_id: complexID,
                layout: layout,
                area: area,
                location: location,
                total_price: totalPrice,
                unit_price: unitPrice,
                visitor_num: visitorNum,
                detail: detail,
            };
            houses.push(house);
        });
        return houses;
    }

    async parse(complexID: string) {
        let url = "http://cd.lianjia.com/ershoufang/c" + complexID + "/";
        let html = await requestPromise(url);
        let $ = cheerio.load(html);
        let totalPage = $(".page-box").attr("page-data").trim();
        let totalPageNum = parseInt(JSON.parse(totalPage)['totalPage']);
        if (totalPageNum >= 1) {
            let jobs: Promise<any>[] = [];
            for (let pageNum = 1; pageNum <= totalPageNum; pageNum++) {
                let realUrl = url + "pg" + pageNum;
                jobs.push(this.realParse(realUrl, complexID).then((houses) => {
                    if (houses.length > 0) {
                        this.houseManager.save(houses);
                    }
                }));
            }
            await Promise.all(jobs);
        }
    }

    private async realRun() {
        let date = new Date();
        while (true) {
            let complexes = await this.complexManager.getComplexesToBeUpdated(date);
            if (complexes.length === 0) {
                break;
            }
            let jobs: Promise<any>[] = [];
            for (let complex of complexes) {
                jobs.push(this.parse(complex.lj_id));
            }
            await Promise.all(jobs);
        }
    }

    public run() {
        debug("Start to run house selling spider...");
        this.realRun()
    }
}

