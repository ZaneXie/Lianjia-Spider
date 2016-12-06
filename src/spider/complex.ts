/**
 * Created by qing.he on 2016/12/5.
 */

import requestPromise = require("request-promise");
import cheerio = require("cheerio");
import Bluebird = require('bluebird');
import {getDebugger} from "../util/debug";
import {ComplexManager} from "../manager/complex";
let debug = getDebugger("spider");

export interface ComplexSpider {
    run();
}

export class CDComplexSpider implements ComplexSpider {
    async parse(pageNum: number) {
        let url = "http://cd.lianjia.com/ershoufang/pg" + pageNum + "/";
        debug("parsing url: " + url);
        let html = await requestPromise(url);
        let $ = cheerio.load(html);
        let result: {}[] = [];
        $(".main-box .house-lst li").each(function (key, ele) {
            let where = $(ele).find(".info-panel .where a span").text();
            let url = $(ele).find(".info-panel .where a").attr("href");
            let pattern = /(\d{8,})/
            let match = pattern.exec(url);
            let id = "";
            if (match && match[0]) {
                id = match[0];
            }
            result.push({id, url, where});
        });
        debug("get " + result.length + " elements.");
        return result;
    }

    private i: number = 1;
    private totalPage: number = 1;
    private thread: number = 1;

    private async realRun() {
        if (this.i > this.totalPage){
            return;
        }
        let jobs: Promise<any>[] = [];
        for (let k = 0; k < this.thread && this.i <= this.totalPage; k++, this.i++) {
            jobs.push(this.parse(this.i).then((obj) => {
                let CM = new ComplexManager();
                obj.forEach((item, index)=> {
                    CM.save({ljID:item["id"], url:item["url"], name:item["where"]});
                });
            }));
        }
        await Promise.all(jobs);
        this.realRun();
    }

    public run() {
        this.i = 1;
        this.totalPage = 1;
        this.thread = 1;
        this.realRun();
    }
}

