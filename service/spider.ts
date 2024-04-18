import axios from "axios";
import sleep from "@/utils/sleep";
import db from "@/utils/db";

export const config = {
  cookie: process.env.COOKIE || "",
  userAgent: process.env.USER_AGENT || "",
  upperMid: process.env.UPPER_MID || "",
  timeout: 5000,
  delay: 5000,
};

const instance = axios.create({
  timeout: config.timeout,
  headers: { Cookie: config.cookie, "User-Agent": config.userAgent },
});

const listAllFavorite = async () => {
  try {
    const response = await instance.get(
      `https://api.bilibili.com/x/v3/fav/folder/created/list-all`,
      {
        params: {
          up_mid: config.upperMid,
        },
      }
    );
    return response.data.data;
  } catch (error) {
    console.error(error);
  }
};

const getFavoriteMetadata = async (media_id: number) => {
  try {
    const response = await instance.get(
      `https://api.bilibili.com/x/v3/fav/folder/info`,
      {
        params: {
          media_id,
        },
      }
    );
    return response.data.data;
  } catch (error) {
    console.error(error);
  }
};

const getFavoriteContent = async (media_id: number, pn: number) => {
  try {
    const response = await instance.get(
      `https://api.bilibili.com/x/v3/fav/resource/list`,
      {
        params: {
          media_id,
          ps: 20,
          pn,
        },
      }
    );
    return response.data.data;
  } catch (error) {
    console.error(error);
  }
};

const saveFavoriteContent = async (media_id: number, media_count: number) => {
  const favoriteContent = await Promise.all(
    Array.from({ length: Math.ceil(media_count / 20) }).map((_, index) =>
      getFavoriteContent(media_id, index + 1)
    )
  );
  // save favoriteContent to database
};

const saveFavorite = async () => {
  console.log(`spider config: ${config}`);

  const favorites = await listAllFavorite();
  const favoritesWithMetadata = await Promise.all(
    favorites.list.map((favorite: { id: number }) =>
      getFavoriteMetadata(favorite.id)
    )
  );
  // save favoritesWithMetadata to database
  for (const favorite of favoritesWithMetadata) {
    await saveFavoriteContent(favorite.id, favorite.media_count);
    console.log(`Saved favorite: ${favorite.id}`);
    await sleep(config.delay);
  }
};

export default saveFavorite;
