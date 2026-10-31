using System;
using System.Reflection;
using UnityEngine;

public static class TonyEagleSessionCheatRegression
{
    public static void Validate()
    {
        string[] stats = { "speed", "jump", "spin" };
        bool[] exists = Array.ConvertAll(stats, PlayerPrefs.HasKey);
        float[] saved = Array.ConvertAll(stats, stat => PlayerPrefs.GetFloat(stat));
        bool hadMarker = PlayerPrefs.HasKey("leaderboard_cheat_used");
        int marker = PlayerPrefs.GetInt("leaderboard_cheat_used");
        MethodInfo freshSession = typeof(BrowserBridge).GetMethod("Install", BindingFlags.Static | BindingFlags.NonPublic);
        Action<bool, string> require = (ok, message) => { if (!ok) throw new Exception(message); };
        BrowserBridge bridge = UnityEngine.Object.FindObjectOfType<BrowserBridge>();
        GameManager manager = UnityEngine.Object.FindObjectOfType<GameManager>();
        try
        {
            PlayerPrefs.DeleteKey("leaderboard_cheat_used");
            foreach (string stat in stats) PlayerPrefs.SetFloat(stat, 1);
            freshSession.Invoke(null, null);
            bridge.EnableUnlimitedUpgradePoints("");
            manager.UpgradeSpeed(); manager.UpgradeJump(); manager.UpgradeSpin();
            require(BrowserBridge.UnlimitedUpgradePoints, "Cheat did not activate");
            require(!PlayerPrefs.HasKey("leaderboard_cheat_used"), "Cheat persisted a marker");
            foreach (string stat in stats)
            {
                require(BrowserBridge.GetUpgrade(stat) > 1, "Cheat upgrade not available in session");
                require(PlayerPrefs.GetFloat(stat) == 1, "Cheat modified saved normal upgrades");
            }
            bridge.EnableUnlimitedUpgradePoints("");
            require(BrowserBridge.GetUpgrade("spin") == 26, "Repeating code reset session upgrades");
            freshSession.Invoke(null, null);
            require(!BrowserBridge.UnlimitedUpgradePoints, "Fresh session retained cheat");
            foreach (string stat in stats) require(BrowserBridge.GetUpgrade(stat) == 1, "Fresh session lost normal progress or retained cheat upgrades");
            PlayerPrefs.SetInt("leaderboard_cheat_used", 1);
            freshSession.Invoke(null, null);
            require(!PlayerPrefs.HasKey("leaderboard_cheat_used"), "Legacy cheat marker not removed");
            foreach (string stat in stats) require(!PlayerPrefs.HasKey(stat), "Legacy cheat upgrades not removed");
            Debug.Log("TONY_EAGLE_SESSION_CHEAT_PASSED session-only upgrades, normal progress retained, refresh reset, legacy cleanup");
        }
        finally
        {
            for (int i = 0; i < stats.Length; i++)
                if (exists[i]) PlayerPrefs.SetFloat(stats[i], saved[i]);
                else PlayerPrefs.DeleteKey(stats[i]);
            if (hadMarker) PlayerPrefs.SetInt("leaderboard_cheat_used", marker);
            else PlayerPrefs.DeleteKey("leaderboard_cheat_used");
            PlayerPrefs.Save();
        }
    }
}
