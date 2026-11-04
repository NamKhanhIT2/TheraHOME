import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/* Không khai báo cache nào, giống CRM.
 *
 * App này chỉ đọc D1 và render — dữ liệu đã nằm sẵn ở edge nên không cần
 * incrementalCache trên R2/KV. Mỗi request một lần đọc D1, rẻ và luôn đúng.
 */
export default defineCloudflareConfig();
