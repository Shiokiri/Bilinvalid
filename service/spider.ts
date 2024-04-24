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

const request = axios.create({
  timeout: config.timeout,
  headers: { Cookie: config.cookie, "User-Agent": config.userAgent },
});

const api = {
  listAllFavorite: async () => {
    try {
      const response = await request.get(
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
  },
  getFavoriteMetadata: async (media_id: number) => {
    try {
      const response = await request.get(
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
  },
  getFavoriteContent: async (media_id: number, pn: number) => {
    try {
      const response = await request.get(
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
  },
};

const saveFavoritesWithMetadataToDatabase = async (
  favoritesWithMetadata: any
) => {
  const favoriteIdsSet = new Set();
  for (const favorite of favoritesWithMetadata) {
    favoriteIdsSet.add(BigInt(favorite.id));
  }
  const favorites = await db.favorite.findMany();
  for (const favorite of favorites) {
    if (!favoriteIdsSet.has(favorite.id)) {
      await db.favorite.delete({
        where: {
          id: favorite.id,
        },
      });
    }
  }
  for (const [index, favorite] of favoritesWithMetadata.entries()) {
    const data = {
      fid: favorite.fid,
      mid: favorite.mid,
      attr: favorite.attr,
      title: favorite.title,
      cover: favorite.cover,
      upperMid: favorite.upper.mid,
      upperName: favorite.upper.name,
      upperFace: favorite.upper.face,
      upperFollowed: favorite.upper.followed,
      upperVipType: favorite.upper.vip_type,
      upperVipStatue: favorite.upper.vip_statue,
      coverType: favorite.cover_type,
      collect: favorite.cnt_info.collect,
      play: favorite.cnt_info.play,
      thumbUp: favorite.cnt_info.thumb_up,
      share: favorite.cnt_info.share,
      type: favorite.type,
      intro: favorite.intro,
      ctime: new Date(favorite.ctime * 1000),
      mtime: new Date(favorite.mtime * 1000),
      state: favorite.state,
      favState: favorite.fav_state,
      likeState: favorite.like_state,
      mediaCount: favorite.media_count,
      index,
    };
    await db.favorite.upsert({
      where: {
        id: favorite.id,
      },
      update: {
        ...data,
      },
      create: {
        ...data,
        id: favorite.id,
      },
    });
  }
};

const saveFavoriteContentToDatabase = async (favoriteContent: any) => {
  for (const media of favoriteContent.medias) {
    const data = {
      id: media.id,
      favorite: {
        connect: {
          id: media.fid,
        },
      },
    };
  }
};

const saveFavoriteContent = async (media_id: number, media_count: number) => {
  const favoriteContent = await Promise.all(
    Array.from({ length: Math.ceil(media_count / 20) }).map((_, index) =>
      api.getFavoriteContent(media_id, index + 1)
    )
  );

  // save favoriteContent to database
  await saveFavoriteContentToDatabase(favoriteContent);
};

const saveFavorite = async () => {
  const favorites = await api.listAllFavorite();
  const favoritesWithMetadata = await Promise.all(
    favorites.list.map((favorite: { id: number }) =>
      api.getFavoriteMetadata(favorite.id)
    )
  );

  // save favoritesWithMetadata to database
  await saveFavoritesWithMetadataToDatabase(favoritesWithMetadata);
  return;

  for (const favorite of favoritesWithMetadata) {
    await saveFavoriteContent(favorite.id, favorite.media_count);
    console.log(`Saved favoriteId: ${favorite.id}`);
    await sleep(config.delay);
  }
};

export default saveFavorite;
