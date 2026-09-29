# Media files to upload

Drop these files into the `/media/` folder. Filenames must match exactly for images to appear. All originals from unywebs.com live at `https://unywebs.com/wp-content/uploads/2025/05/` (or `.../2023/03/` for the two hero images).

## Global / branding

| Filename           | Used on            | Original source                                            |
|--------------------|--------------------|-------------------------------------------------------------|
| `site-logo.png`    | Header (all pages) | `/wp-content/uploads/2025/05/site-logo.png`                 |

## Home page (`index.html`)

| Filename                  | Used on   | Original                                                                 |
|---------------------------|-----------|--------------------------------------------------------------------------|
| `hero-illustration.svg`   | Hero      | `/wp-content/uploads/2023/03/bebusiness7-home-pic1.svg`                  |
| `about-pic.jpg` **or** `about-pic.webp` | About split | `/wp-content/uploads/2023/03/bebusiness7-about-pic2.webp` |

## Guides index (`guides.html`)

| Filename              | Used on           | Original                                                        |
|-----------------------|-------------------|-----------------------------------------------------------------|
| `official-email.jpg`  | 2 guide cards     | `/wp-content/uploads/2025/05/official-email-960x750.jpg`        |
| `web-registering.jpg` | WordPress card    | `/wp-content/uploads/2025/05/web-registering-960x750.jpg`       |

## Article: Your app needs five things

| Filename              | Original                                                        |
|-----------------------|-----------------------------------------------------------------|
| `official-email.jpg`  | `/wp-content/uploads/2025/05/official-email.jpg` (already listed above) |

## Article: Registering Your Official Company Emails

| Filename                     | Original                                                   |
|------------------------------|------------------------------------------------------------|
| `official-email.jpg`         | (already listed)                                            |
| `team-handles-it.jpg`        | `/wp-content/uploads/2025/05/3ddfccc5-665a-4c31-af54-2b78bd7d21d1.jpg` |
| `sign-up.jpg`                | `/wp-content/uploads/2025/05/sign-up.jpg`                  |
| `diy.png`                    | `/wp-content/uploads/2025/05/diy.png`                      |
| `add-domain-name.png`        | `/wp-content/uploads/2025/05/add-domain-name.png`          |
| `select-the-txt-method.jpg`  | `/wp-content/uploads/2025/05/select-the-txt-method.jpg`    |
| `mx.jpg`                     | `/wp-content/uploads/2025/05/mx.jpg`                       |
| `select-cname-record.jpg`    | `/wp-content/uploads/2025/05/select-cname-record.jpg`      |
| `cname.jpg`                  | `/wp-content/uploads/2025/05/cname.jpg`                    |
| `add-users.jpg`              | `/wp-content/uploads/2025/05/add-users.jpg`                |
| `add-user-details.jpg`       | `/wp-content/uploads/2025/05/add-user-details.jpg`         |
| `dns-values.jpg`             | `/wp-content/uploads/2025/05/dns-values.jpg`               |
| `mx-record-values.jpg`       | `/wp-content/uploads/2025/05/mx-record-values.jpg`         |
| `spf-record-value.jpg`       | `/wp-content/uploads/2025/05/spf-record-value.jpg`         |
| `dkim-record-value.jpg`      | `/wp-content/uploads/2025/05/dkim-record-value.jpg`        |

## Article: WordPress Site Registration

| Filename                | Original                                                     |
|-------------------------|--------------------------------------------------------------|
| `web-registering.jpg`   | (already listed)                                             |
| `hosting-diagram.jpg`   | `/wp-content/uploads/2025/05/hosting-diagram.jpg`            |
| `register-hosting.jpg`  | `/wp-content/uploads/2025/05/register-hosting.jpg`           |
| `step-1.png`            | `/wp-content/uploads/2025/05/image.png`                      |
| `step-2.png`            | `/wp-content/uploads/2025/05/image-1.png`                    |
| `step-3a.png`           | `/wp-content/uploads/2025/05/image-2.png`                    |
| `step-3b.png`           | `/wp-content/uploads/2025/05/image-3.png`                    |
| `step-4.png`            | `/wp-content/uploads/2025/05/image-4.png`                    |
| `step-5.png`            | `/wp-content/uploads/2025/05/image-5.png`                    |

## Quick download tip

If you want to grab every image from the live WordPress site at once, run this on your machine:

```bash
# creates media/ and pulls the media library folder
mkdir -p media
wget -r -np -nH --cut-dirs=3 -A jpg,jpeg,png,webp,svg,gif \
  https://unywebs.com/wp-content/uploads/2025/05/ -P media/
wget -r -np -nH --cut-dirs=3 -A jpg,jpeg,png,webp,svg,gif \
  https://unywebs.com/wp-content/uploads/2023/03/ -P media/
```

Then rename the files to match the table above (or update the `<img src="...">` tags to whatever names you prefer).
